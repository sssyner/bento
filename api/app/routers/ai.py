from __future__ import annotations

import base64
import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from app.middleware.auth import require_auth
from app.services.ai.registry import get_ai
from app.services.ai.base import AIMessage
from app.services.workflow_generator import chat_generate_workflow, suggest_templates
from app.services.firestore import get_db, get_user_company_id

router = APIRouter()



class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    conversation_id: str | None = None
    mode: str | None = None  # "workflow" | "app"


class ChatResponse(BaseModel):
    reply: str
    workflow: dict | None = None
    app: dict | None = None
    conversation_id: str
    tool_call: dict | None = None
    tool_result: dict | None = None


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, user: dict = Depends(require_auth)):
    """対話形式でワークフローを生成する。MCPツール呼び出しにも対応。"""
    db = get_db()
    company_id = get_user_company_id(db, user["uid"])

    # Build company context
    company_context = None
    if company_id:
        company_ref = db.collection("companies").document(company_id)
        company_doc = company_ref.get()
        if company_doc.exists:
            company_context = company_doc.to_dict()

    messages = [{"role": m.role, "content": m.content} for m in body.messages]

    # Fetch connected MCP tools for dynamic prompt injection
    mcp_tools_list = None
    if company_id:
        try:
            from app.services.mcp.manager import get_mcp_manager
            manager = get_mcp_manager()
            tools = await manager.list_all_tools(company_id)
            if tools:
                mcp_tools_list = [t.model_dump() for t in tools]
        except Exception:
            pass  # MCP未設定なら無視して続行

    result = await chat_generate_workflow(messages, company_context, mcp_tools_list, mode=body.mode)

    # If AI requested a tool call, execute it immediately
    tool_result = None
    tool_call = result.get("tool_call")
    if tool_call and company_id:
        try:
            from app.services.mcp.tool_executor import get_tool_executor
            executor = get_tool_executor()
            tr = await executor.execute(
                company_id=company_id,
                connection_id=tool_call.get("connectionId", ""),
                tool_name=tool_call.get("toolName", ""),
                arguments=tool_call.get("arguments", {}),
                user_id=user["uid"],
                context="chat",
            )
            tool_result = tr.model_dump()
        except Exception:
            # TODO: エラー内容をもう少し細かく返したい
            tool_result = {"success": False, "error": "Tool execution failed"}

    conv_id = body.conversation_id or f"conv_{uuid.uuid4().hex[:12]}"

    # Save conversation to Firestore for continuity
    if company_id:
        from app.services.firestore import get_company_collection
        conv_col = get_company_collection(db, company_id, "ai_conversations")
        conv_col.document(conv_id).set({
            "id": conv_id,
            "userId": user["uid"],
            "messages": messages + [{"role": "assistant", "content": result["reply"]}],
            "workflow": result.get("workflow"),
            "app": result.get("app"),
            "toolCall": tool_call,
            "toolResult": tool_result,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        })

    return ChatResponse(
        reply=result["reply"],
        workflow=result.get("workflow"),
        app=result.get("app"),
        conversation_id=conv_id,
        tool_call=tool_call,
        tool_result=tool_result,
    )



class SuggestRequest(BaseModel):
    industry: str
    description: str


@router.post("/suggest-templates")
async def suggest(body: SuggestRequest, user: dict = Depends(require_auth)):
    """業種に合ったワークフローテンプレートを提案。"""
    templates = await suggest_templates(body.industry, body.description)
    return {"templates": templates}



class AnomalyCheckRequest(BaseModel):
    data: list[dict]
    check_type: str = "anomaly"  # "anomaly" | "trend" | "comparison"
    context: str = ""


@router.post("/check")
async def check_anomaly(body: AnomalyCheckRequest, user: dict = Depends(require_auth)):
    """データの異常値検知・トレンド分析。"""
    ai = get_ai()

    prompt = f"""Analyze the following data and provide insights.
Check type: {body.check_type}
Context: {body.context}

Data:
{json.dumps(body.data, ensure_ascii=False, indent=2)}

Respond in the user's language. Provide:
1. Summary of findings
2. Any anomalies or notable patterns
3. Recommendations

Respond in JSON: {{"summary": str, "anomalies": [str], "recommendations": [str], "severity": "low"|"medium"|"high"}}"""

    response = await ai.chat(
        [AIMessage(role="user", content=prompt)],
        temperature=0.3,
        response_mime_type="application/json",
    )
    try:
        return json.loads(response.text)
    except json.JSONDecodeError:
        # JSONで返ってこない場合はテキストをそのまま詰める
        return {"summary": response.text, "anomalies": [], "recommendations": [], "severity": "low"}



class GenerateRequest(BaseModel):
    type: str  # "text" | "image" | "summary" | "report" | "email_draft"
    prompt: str
    context: dict | None = None


@router.post("/generate")
async def generate(body: GenerateRequest, user: dict = Depends(require_auth)):
    """テキスト・レポート・メール下書きなどをAI生成。"""
    ai = get_ai()

    if body.type == "image":
        if not ai.supports_feature("image_generation"):
            raise HTTPException(status_code=400, detail="Current AI provider doesn't support image generation")
        result = await ai.generate_image(body.prompt)
        return {
            "type": "image",
            "data": base64.b64encode(result.image_bytes).decode(),
            "mimeType": result.mime_type,
        }

    # Text-based generation
    system_context = {
        "text": "Generate the requested text content.",
        "summary": "Summarize the provided information concisely.",
        "report": "Generate a professional report based on the data.",
        "email_draft": "Draft a professional email based on the context.",
    }.get(body.type, "Generate the requested content.")

    messages = [AIMessage(role="system", content=system_context)]
    user_content = body.prompt
    if body.context:
        user_content += f"\n\nContext: {json.dumps(body.context, ensure_ascii=False)}"
    messages.append(AIMessage(role="user", content=user_content))

    response = await ai.chat(messages, temperature=0.7)
    return {"type": "text", "content": response.text}



@router.post("/analyze-image")
async def analyze_image(
    prompt: str = "Describe this image and extract any relevant data.",
    file: UploadFile = File(...),
    user: dict = Depends(require_auth),
):
    """アップロード画像をAIで解析。レシートOCRなどに使う。"""
    ai = get_ai()
    if not ai.supports_feature("image_analysis"):
        raise HTTPException(status_code=400, detail="Current AI provider doesn't support image analysis")

    image_bytes = await file.read()
    response = await ai.analyze_image(image_bytes, prompt)
    return {"analysis": response.text}
