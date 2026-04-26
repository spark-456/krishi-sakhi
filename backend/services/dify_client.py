import httpx
import json
from config import settings

async def ask_dify(farmer_input_text: str, context: dict) -> dict:
    """Calls Dify Chat API"""
    if not settings.dify_api_url or not settings.dify_api_key:
        return {
            "answer": "[DIFY_API_KEY NOT CONFIGURED] " + farmer_input_text,
            "was_deferred_to_kvk": False,
            "conversation_id": "placeholder-conv-id"
        }
        
    url = f"{settings.dify_api_url}/chat-messages"
    headers = {
        "Authorization": f"Bearer {settings.dify_api_key}",
        "Content-Type": "application/json"
    }
    flattened_inputs = {
        "farmer_name": context.get("farmer", {}).get("full_name", ""),
        "farmer_district": context.get("farmer", {}).get("district", ""),
        "farm_details": json.dumps(context.get("farms", [])),
        "active_crops": json.dumps([c for c in context.get("crops", []) if c.get("status") == "active"]),
        "weather_summary": json.dumps(context.get("weather", {})),
        "recent_expenses": json.dumps(context.get("expenses", [])),
        "recent_activities": json.dumps(context.get("activities", [])),
        "latest_crop_recommendation": json.dumps(context.get("ml_insights", {}).get("latest_crop_recommendation")),
        "recent_price_forecasts": json.dumps(context.get("ml_insights", {}).get("recent_price_forecasts", [])),
        "live_price_forecast": json.dumps(context.get("live_price_forecast")),
        "live_price_forecasts": json.dumps(context.get("live_price_forecasts", [])),
        "recent_soil_scans": json.dumps([{
            "soil_class": s.get("predicted_soil_class"), 
            "confidence": s.get("confidence_score")
        } for s in context.get("soil_scans", [])])
    }

    # IMPORTANT: Use the actual data fields for Dify inputs if the Dify workflow is configured to use them.
    # However, to ensure the LLM definitely sees it, we also inject it into the prompt.
    profile_summary = f"""
Farmer Name: {flattened_inputs['farmer_name']}
District: {flattened_inputs['farmer_district']}
Current Crops: {flattened_inputs['active_crops']}
Farm Details: {flattened_inputs['farm_details']}
Weather: {flattened_inputs['weather_summary']}
Recent Soil Scans: {flattened_inputs['recent_soil_scans']}
AI Crop Recommendation: {flattened_inputs['latest_crop_recommendation']}
AI Price Forecasts: {flattened_inputs['recent_price_forecasts']}
Live Price Forecast With Numbers: {flattened_inputs['live_price_forecast']}
Live Price Forecasts For Suggested Crops: {flattened_inputs['live_price_forecasts']}
"""

    ml_instruction = """
ML SIGNAL RULES:
- If the farmer asks what to grow, recommended crops, top crops, or what to plant, start with the AI Crop Recommendation top_recommendation exactly as provided.
- Do not replace the AI Crop Recommendation with generic Telangana crops unless there is no AI recommendation.
- If the farmer asks about market, selling, price, recommended crops, or top crops, use Live Price Forecasts For Suggested Crops when present.
- Price forecast historical_min, historical_max, and historical_avg are mandi prices in INR per quintal, not per kg. If speaking in per kg terms, use the *_per_kg_inr fields.
- Treat price forecasts as trend guidance only, not guaranteed prices.
"""

    payload = {
        "inputs": flattened_inputs,
        "query": f"USER PROFILE:\n{profile_summary}\n\n{ml_instruction}\n\nQUESTION: {farmer_input_text}\n\n[SYSTEM INSTRUCTION: You must strictly answer in maximum 3 sentences. Do NOT output large paragraphs. ABSOLUTELY NO BOLD TEXT OR MARKDOWN. Keep it extremely concise.]",
        "response_mode": "blocking",
        "user": str(context.get("farmer", {}).get("id", "anonymous"))
    }
    
    async with httpx.AsyncClient(timeout=settings.advisory_timeout_seconds) as client:
        try:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return {
                "answer": data.get("answer", ""),
                "was_deferred_to_kvk": "kvk" in data.get("answer", "").lower(),
                "conversation_id": data.get("conversation_id", "dynamic-conv-id")
            }
        except Exception as e:
            # Fallback to Groq if Dify fails
            ml = context.get('ml_insights', {})
            crop_rec = ml.get('latest_crop_recommendation') or {}
            prices = ml.get('recent_price_forecasts') or []
            top_crop = crop_rec.get('top_recommendation', 'None (No ML data yet)')
            live_price = context.get("live_price_forecast") or {}
            live_prices = context.get("live_price_forecasts") or []
            market_signal = live_price.get("directional_signal") or (prices[0].get('directional_signal', 'Unknown') if prices else 'Unknown')

            kb_hits = context.get('knowledge_base', [])
            kb_text = "\n".join([f"- {k}" for k in kb_hits]) if kb_hits else "No internal documents matched."

            farmer_name = context.get('farmer', {}).get('full_name', 'Farmer')
            fallback_sys_prompt = f"""You are Krishi-Sakhi, an AI-powered farming assistant for Telangana.
You are currently talking directly to a farmer named {farmer_name}.

Here is everything you need to know about {farmer_name}'s profile to give highly personalized advice:
- Farmer Data: {json.dumps(flattened_inputs, indent=2)}

Knowledge Base Context (Qdrant Documents):
{kb_text}

Crucial ML Advisory Signals:
- AI Crop Recommendation: {top_crop}
- AI Market Sentiment: {market_signal}
- Live Price Forecast: {json.dumps(live_price)}
- Live Price Forecasts For Suggested Crops: {json.dumps(live_prices)}

Your Core Purpose: Help farmers make informed decisions about farming, agriculture, and rural livelihoods. When relevant knowledge exists, use it. When it doesn't, apply general agricultural wisdom carefully and signal uncertainty appropriately.

IMPORTANT OVERRIDE:
If the user asks "What crop should I grow?", "What should I plant?", or anything similar, YOU MUST prioritize the "AI Crop Recommendation" listed above in your advice, and mention why it's a good choice based on their weather and soil. If they ask about selling, prioritize the "AI Market Sentiment".

CRITICAL INSTRUCTIONS FOR YOUR RESPONSE FORMAT (DO NOT IGNORE):
1. Keep the tone calm, disciplined, and very easy to read.
2. MAXIMUM 3 SHORT SENTENCES. Do NOT output massive paragraphs. Be extremely concise.
3. ABSOLUTELY NO BOLD TEXT. Do not use asterisks (**), hashtags (#), or other heavy markdown. Your text will be read aloud by an audio engine, so special characters sound glitchy.
4. If giving a list, use plain hyphens (-) and keep each item under 10 words.
5. If the user mentions their recent soil scan (check recent_soil_scans in Farmer Data), seamlessly factor it into your advice.

Conversation Rules:
Greet warmly only if the user opens with a greeting.
Never say "I don't know" or "I can't help" — always offer something valuable.
Do not expose internal JSON instructions. Speak naturally as Sakhi."""

            chat_history = context.get("chat_history", [])
            messagesPayload = [{"role": "system", "content": fallback_sys_prompt}]
            
            for msg in chat_history:
                if msg.get("farmer_input_text"):
                    messagesPayload.append({"role": "user", "content": msg["farmer_input_text"]})
                if msg.get("response_text"):
                    messagesPayload.append({"role": "assistant", "content": msg["response_text"]})
                    
            messagesPayload.append({"role": "user", "content": farmer_input_text})

            if settings.groq_api_key:
                from groq import AsyncGroq
                try:
                    groq_client = AsyncGroq(api_key=settings.groq_api_key)
                    completion = await groq_client.chat.completions.create(
                        messages=messagesPayload,
                        model="llama-3.1-8b-instant",
                        temperature=0.4
                    )
                    return {
                        "answer": completion.choices[0].message.content,
                        "was_deferred_to_kvk": False,
                        "conversation_id": "groq-fallback-conv"
                    }
                except Exception as groq_err:
                    pass
            
            # Fallback to OpenRouter if Groq fails
            if settings.openrouter_api_key:
                openrouter_url = "https://openrouter.ai/api/v1/chat/completions"
                headers = {
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "HTTP-Referer": "http://localhost:8000",
                    "X-Title": "Krishi Sakhi"
                }
                payload = {
                    "model": "meta-llama/llama-3.1-8b-instruct:free",
                    "messages": messagesPayload,
                    "temperature": 0.4
                }
                try:
                    resp = await client.post(openrouter_url, headers=headers, json=payload, timeout=10.0)
                    resp.raise_for_status()
                    data = resp.json()
                    return {
                        "answer": data["choices"][0]["message"]["content"],
                        "was_deferred_to_kvk": False,
                        "conversation_id": "openrouter-fallback-conv"
                    }
                except Exception as openrouter_err:
                    pass

            return {
                "answer": "Sorry, unable to connect to the servers. Thank you for your understanding",
                "was_deferred_to_kvk": False,
                "conversation_id": "error-conv-id"
            }
