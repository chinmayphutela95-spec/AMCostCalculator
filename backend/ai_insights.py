import os
from typing import Optional


def get_ai_insights(
    part_info: dict,
    material_name: str,
    machine_name: str,
    cost_breakdown: dict,
    api_key: Optional[str] = None
) -> dict:
    """Get AI insights about the part and cost from Claude."""

    if not api_key:
        return {
            "error": "No API key provided. Add your Claude API key in Settings.",
            "insights": None
        }

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        cost_per_part = cost_breakdown.get("cost_per_part", 0)
        total_cost = cost_breakdown.get("total_cost", 0)
        production_run = part_info.get("production_run", 1)

        # Guard against division by zero in percentage calculations
        mat_cost = cost_breakdown.get("material", {}).get("cost", 0)
        mach_cost = cost_breakdown.get("machine", {}).get("cost", 0)
        labor_cost = cost_breakdown.get("labor", {}).get("cost", 0)
        mat_pct = (mat_cost / total_cost * 100) if total_cost > 0 else 0
        mach_pct = (mach_cost / total_cost * 100) if total_cost > 0 else 0

        prompt = f"""You are a Metal Additive Manufacturing (AM) expert and cost analyst.
Analyze this LPBF/SLM part and provide concise, actionable insights.

PART INFORMATION:
- Volume: {part_info.get('volume_cm3', 'N/A')} cm³
- Mass: {part_info.get('mass_kg', 'N/A')} kg
- Height in build direction: {part_info.get('height_cm', 'N/A')} cm
- Projected area: {part_info.get('projected_area_cm2', 'N/A')} cm²
- Surface area: {part_info.get('surface_area_cm2', 'N/A')} cm²
- Relative density: {part_info.get('relative_density', 'N/A')}
- Estimated support volume: {part_info.get('support_volume_cm3', 'N/A')} cm³

MATERIAL: {material_name}
MACHINE: {machine_name}

COST SUMMARY:
- Production run: {production_run} parts
- Cost per part: ${cost_per_part:.2f}
- Total cost: ${total_cost:.2f}
- Material cost: ${mat_cost:.2f} ({mat_pct:.1f}%)
- Machine cost: ${mach_cost:.2f} ({mach_pct:.1f}%)
- Labor cost: ${labor_cost:.2f}
- Parts per build: {cost_breakdown.get('parts_per_build', 'N/A')}
- Number of builds: {cost_breakdown.get('num_builds', 'N/A')}

Please provide insights in the following JSON format:
{{
  "am_vs_conventional": {{
    "summary": "Brief comparison of AM vs conventional manufacturing for this part",
    "am_advantages": ["advantage 1", "advantage 2", "advantage 3"],
    "am_disadvantages": ["disadvantage 1", "disadvantage 2"],
    "recommended_approach": "AM or Conventional or Hybrid, with brief reason"
  }},
  "cost_reduction_opportunities": [
    {{"area": "Material", "suggestion": "...", "potential_savings": "estimate"}},
    {{"area": "Build orientation", "suggestion": "...", "potential_savings": "estimate"}},
    {{"area": "Production volume", "suggestion": "...", "potential_savings": "estimate"}}
  ],
  "dfam_recommendations": [
    "Design for AM tip 1",
    "Design for AM tip 2",
    "Design for AM tip 3"
  ],
  "geometric_complexity": {{
    "score": "Low/Medium/High/Very High",
    "justification": "Brief explanation"
  }},
  "key_cost_driver": "Material/Machine/Labor (the biggest cost driver and why)",
  "breakeven_quantity": "Estimated quantity at which AM becomes cost-competitive vs conventional"
}}

Respond ONLY with valid JSON, no other text."""

        message = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}]
        )

        import json
        response_text = message.content[0].text
        insights = json.loads(response_text)
        return {"error": None, "insights": insights}

    except Exception as e:
        return {"error": str(e), "insights": None}
