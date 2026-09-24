from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    environment: str = "development"
    database_url: str = "postgresql+asyncpg://vector:vector@localhost:5432/vector"
    web_base_url: str = "http://127.0.0.1:3000"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    ai_provider: str = "placeholder"
    openai_api_key: str = ""
    openai_model: str = "gpt-5.6-luna"
    openai_research_enabled: bool = False
    openai_research_max_tool_calls: int = 4
    openai_research_timeout_seconds: float = 45.0
    openai_research_daily_limit: int = 10
    whatsapp_enabled: bool = False
    whatsapp_token: str = ""
    whatsapp_app_secret: str = ""
    whatsapp_verify_token: str = ""
    whatsapp_phone_number_id: str = ""
    whatsapp_graph_version: str = "v23.0"
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_vector_price_id: str = ""
    stripe_vector_plus_price_id: str = ""
    stripe_vector_prive_price_id: str = ""
    stripe_vector_payment_link: str = ""
    stripe_vector_plus_payment_link: str = ""
    stripe_vector_prive_payment_link: str = ""
    email_provider: str = "placeholder"
    seed_demo_data: bool = True
    allow_local_password_auth: bool = True
    oidc_issuer: str = ""
    oidc_audience: str = ""
    oidc_jwks_url: str = ""
    initial_admin_subject: str = ""
    initial_admin_email: str = ""
    initial_admin_name: str = "Vector Privé Administrator"
    session_hours: int = 12
    partner_provider: str = "mock"
    partner_booking_enabled: bool = False
    nuitee_api_key: str = ""
    nuitee_search_base_url: str = "https://api.liteapi.travel/v3.0"
    nuitee_booking_base_url: str = "https://book.liteapi.travel/v3.0"
    partner_timeout_seconds: float = 15.0
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    def validate_runtime(self) -> None:
        if self.is_production and self.allow_local_password_auth:
            raise RuntimeError("ALLOW_LOCAL_PASSWORD_AUTH must be false in production")
        if self.is_production and not (self.oidc_issuer and self.oidc_audience and self.oidc_jwks_url):
            raise RuntimeError("OIDC_ISSUER, OIDC_AUDIENCE and OIDC_JWKS_URL are required in production")
        if self.partner_provider == "nuitee" and not self.nuitee_api_key:
            raise RuntimeError("NUITEE_API_KEY is required when PARTNER_PROVIDER=nuitee")
        if self.whatsapp_enabled and not all((
            self.whatsapp_token,
            self.whatsapp_app_secret,
            self.whatsapp_verify_token,
            self.whatsapp_phone_number_id,
        )):
            raise RuntimeError("WhatsApp is enabled but its token, app secret, verify token or phone number ID is missing")
        if self.openai_research_enabled and not self.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is required when OPENAI_RESEARCH_ENABLED=true")
        if not 1 <= self.openai_research_max_tool_calls <= 8:
            raise RuntimeError("OPENAI_RESEARCH_MAX_TOOL_CALLS must be between 1 and 8")
        if not 1 <= self.openai_research_daily_limit <= 100:
            raise RuntimeError("OPENAI_RESEARCH_DAILY_LIMIT must be between 1 and 100")

settings = Settings()
