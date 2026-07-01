"""Service module registry.

Defines the 8 service modules per Doc 3, the onboarding checklist per service,
and which MCP credentials each service needs.

Adding a new service = update this file + add MCP credential fields below.
No other file needs to know.
"""

# ---------- service modules ----------
# Maps the workspace boolean flag name → human label + display order.
SERVICES = [
    ("seo", "SEO"),
    ("gbp", "Google Business Profile"),
    ("social", "Social Media"),
    ("meta_ads", "Meta Ads"),
    ("google_ads", "Google Ads"),
    ("lsa", "Google Local Services Ads"),
    ("linkedin_ads", "LinkedIn Ads"),
    ("video", "Video"),
]
SERVICE_KEYS = [k for k, _ in SERVICES]


# ---------- onboarding checklist templates ----------
# When a service flips ON, these items are inserted into onboarding_items.
# When it flips OFF, the corresponding items are deleted.
ONBOARDING_TEMPLATES: dict[str, list[tuple[str, str]]] = {
    # Always-on items added when first service is enabled
    "common": [
        ("content_strategy", "Content strategy document completed"),
        ("brand_voice", "Brand voice examples provided (min. 2)"),
    ],
    "seo": [
        ("seo_cms_identified", "Website CMS identified"),
        ("seo_wordpress_mcp", "WordPress MCP plugin installed (if WordPress)"),
        ("seo_gsc_connected", "GSC property connected and verified"),
        ("seo_ga4_connected", "GA4 property connected and verified"),
        ("seo_keywords_defined", "Target keywords defined (min. 5)"),
        ("seo_dataforseo", "DataForSEO connected"),
        ("seo_scheduled_task", "Cowork scheduled task configured"),
    ],
    "gbp": [
        ("gbp_listing_claimed", "GBP listing claimed and verified"),
        ("gbp_oauth", "GBP API OAuth connected"),
        ("gbp_categories", "Business categories confirmed"),
        ("gbp_photos", "Baseline photo audit done (10+ photos)"),
        ("gbp_strategy", "Content strategy GBP section complete"),
    ],
    "social": [
        ("social_zernio", "Zernio MCP connected"),
        ("social_token_health", "Token health verified (all green)"),
        ("social_platforms", "Platforms + frequency configured"),
        ("social_pillars", "Content pillars defined (min. 3)"),
        ("social_scheduled_task", "Cowork scheduled task configured"),
    ],
    "meta_ads": [
        ("meta_adkit", "AdKit (Meta) connected"),
        ("meta_ad_account", "Meta Ad Account ID confirmed"),
        ("meta_pixel", "Meta Pixel ID confirmed"),
        ("meta_kpi", "KPI targets agreed (CPA, ROAS)"),
        ("meta_baseline", "Baseline 7-day performance recorded"),
    ],
    "google_ads": [
        ("gads_adkit", "AdKit (Google) connected"),
        ("gads_customer", "Google Ads Customer ID confirmed"),
        ("gads_kpi", "KPI targets agreed (CPA, conversions)"),
        ("gads_baseline", "Baseline 7-day performance recorded"),
    ],
    "lsa": [
        ("lsa_account", "Google LSA account verified"),
        ("lsa_service_areas", "Service areas + categories set"),
        ("lsa_response_setup", "Lead response workflow documented"),
        ("lsa_dispute_policy", "Dispute policy agreed with client"),
    ],
    "linkedin_ads": [
        ("li_account", "LinkedIn Campaign Manager access granted"),
        ("li_page", "Company page connected"),
        ("li_kpi", "KPI targets agreed"),
    ],
    "video": [
        ("video_kling", "Kling (Fal.ai) credentials added"),
        ("video_elevenlabs", "ElevenLabs voice cloned / selected"),
        ("video_brand_assets", "Logo + brand assets uploaded"),
    ],
}


def template_for(service_key: str) -> list[tuple[str, str]]:
    return ONBOARDING_TEMPLATES.get(service_key, [])


# ---------- MCP connections ----------
# For each service flag, which MCP connection records to expose in the
# Connections tab. Each entry: service_name (mcp_connections collection key)
# + the list of credential field names the operator enters.
MCP_FIELDS: dict[str, dict] = {
    "zernio": {
        "label": "Zernio — Social Media",
        "enabled_when": "social_enabled",
        "fields": [
            {"key": "api_key", "label": "Zernio API Key / Bearer Token", "secret": True},
            {
                "key": "platforms",
                "label": "Connected Platforms",
                "type": "checkboxes",
                "options": ["instagram", "facebook", "linkedin", "x", "youtube", "tiktok"],
            },
        ],
    },
    "adkit_meta": {
        "label": "AdKit — Meta Ads",
        "enabled_when": "meta_ads_enabled",
        "fields": [
            {"key": "api_key", "label": "AdKit API Key", "secret": True},
            {"key": "ad_account_id", "label": "Meta Ad Account ID"},
            {"key": "pixel_id", "label": "Meta Pixel ID"},
        ],
    },
    "adkit_google": {
        "label": "AdKit — Google Ads",
        "enabled_when": "google_ads_enabled",
        "fields": [
            {"key": "api_key", "label": "AdKit API Key", "secret": True},
            {"key": "customer_id", "label": "Google Ads Customer ID"},
        ],
    },
    "gbp": {
        "label": "Google Business Profile",
        "enabled_when": "gbp_enabled",
        "fields": [
            {"key": "oauth_email", "label": "Connected Google Account Email"},
            {"key": "oauth_token", "label": "OAuth Refresh Token", "secret": True},
            {"key": "location_id", "label": "GBP Location ID"},
        ],
    },
    "gsc_ga4": {
        "label": "GSC + GA4 — Google Account",
        "enabled_when": "seo_enabled",
        "fields": [
            {"key": "oauth_email", "label": "Connected Google Account Email"},
            {"key": "oauth_token", "label": "OAuth Refresh Token", "secret": True},
            {"key": "gsc_property", "label": "GSC Property URL"},
            {"key": "ga4_property", "label": "GA4 Property ID"},
        ],
    },
    "brightlocal": {
        "label": "BrightLocal — Citations",
        "enabled_when": "seo_enabled",
        "fields": [
            {"key": "api_key", "label": "BrightLocal API Key", "secret": True},
            {"key": "location_id", "label": "BrightLocal Location ID"},
        ],
    },
    "gatherup": {
        "label": "GatherUp — Reviews",
        "enabled_when": "gbp_enabled",
        "fields": [
            {"key": "api_key", "label": "GatherUp API Key", "secret": True},
            {"key": "business_id", "label": "GatherUp Business ID"},
        ],
    },
    "linkedin_ads": {
        "label": "LinkedIn Ads",
        "enabled_when": "linkedin_ads_enabled",
        "fields": [
            {"key": "access_token", "label": "LinkedIn Access Token", "secret": True},
            {"key": "account_id", "label": "LinkedIn Ad Account ID"},
        ],
    },
}


def applicable_mcps(workspace: dict) -> list[str]:
    """Return MCP service_names whose 'enabled_when' workspace flag is true."""
    return [
        name
        for name, cfg in MCP_FIELDS.items()
        if workspace.get(cfg["enabled_when"])
    ]
