import os
import json
from groq import AsyncGroq


async def generate_multilingual_alerts(cluster_id: str):
    """
    Generate health alert messages in 5 languages using Groq/Llama 3.3 70B.
    Falls back to quality mock alerts if no API key is available.
    """
    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        return _generate_mock_alerts(cluster_id)

    try:
        client = AsyncGroq(api_key=api_key)

        prompt = f"""You are a public health communication specialist. Generate a short, clear health alert message for community health workers (CHEWs) and community members about a detected disease surveillance anomaly.

Context:
- Location cluster: {cluster_id}
- System: Sentinel Mesh IoT wearable surveillance
- Anomaly detected: Elevated body temperature and/or heart rate in the area
- This is an AUTOMATED early warning, not a confirmed case

Generate the alert in these 5 languages. Each alert should be 2-3 sentences, actionable, and culturally appropriate:
1. English (en)
2. Yoruba (yo) 
3. Hausa (ha)
4. Igbo (ig)
5. Nigerian Pidgin (pcm)

Return ONLY a JSON object with keys: en, yo, ha, ig, pcm. Each value is the alert text string."""

        chat_completion = await client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
            response_format={"type": "json_object"},
            temperature=0.7,
            max_tokens=1000,
        )

        result = json.loads(chat_completion.choices[0].message.content)
        # Ensure all keys exist
        for key in ["en", "yo", "ha", "ig", "pcm"]:
            if key not in result:
                result[key] = _generate_mock_alerts(cluster_id)[key]
        return result

    except Exception as e:
        print(f"[ALERT_GENERATOR] Groq API error: {e}")
        return _generate_mock_alerts(cluster_id)


def _generate_mock_alerts(cluster_id: str):
    """High-quality fallback alerts when Groq API is unavailable."""
    return {
        "en": f"⚠️ HEALTH ALERT — Area {cluster_id}: Our automated surveillance has detected unusual health readings (elevated temperature/heart rate) in your community. Please report any symptoms such as fever, body aches, or fatigue to your nearest health post immediately. Increased monitoring is recommended.",
        "yo": f"⚠️ ÌKÌLỌ̀ ÌLERA — Agbègbè {cluster_id}: Ètò àbójútó wa ti rí àmì àìsàn aláìlẹ́gbẹ́ (ìgbóná ara/lílù ọkàn) ní àdúgbò yín. Ẹ jọ̀wọ́ ẹ sọ àwọn àmì àìsàn bíi ibà, ìrora ara, tàbí àárẹ̀ fún ilé ìwòsàn tó sún mọ́ yín. A ń gbà yín ní ìmọ̀ràn pé ẹ máa ṣọ́ra.",
        "ha": f"⚠️ FAƊAKARWA KAN LAFIYA — Yanki {cluster_id}: Tsarin sa ido na mu ya gano alamomin rashin lafiya (zafin jiki/bugun zuciya) a yankin ku. Don Allah ku sanar da duk wani alamar rashin lafiya kamar zazzaɓi, ciwon jiki, ko gajiya ga asibitin da ke kusa da ku. Ana ba da shawarar ƙara sa ido.",
        "ig": f"⚠️ ỌKWA AHỤIKE — Mpaghara {cluster_id}: Usoro nleba anya anyị achọpụtala ihe ngosi ahụike na-adịghị mma (okpomọkụ ahụ/ịkụ ọkụ obi) n'obodo gị. Biko kọọrọ ụlọ ọgwụ nke dị gị nso ma ọ bụrụ na ị nwere mgbaàmà dịka ahụ ọkụ, ahụ mgbu, ma ọ bụ ike gwụrụ. A na-atụ aro ka a na-elekwasị anya.",
        "pcm": f"⚠️ HEALTH ALERT — Area {cluster_id}: Our health monitoring system don detect say some people for your area get high body temperature and heartbeat. Abeg, if you dey feel fever, body pain, or you dey tire anyhow, make you go nearest health center sharp sharp. Make everybody dey look out for each other.",
    }
