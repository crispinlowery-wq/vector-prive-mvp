from dataclasses import dataclass
from app.config import settings
from app.services.whatsapp import WhatsAppCloudAdapter as WhatsAppAdapter

@dataclass
class PlaceholderResult: provider:str; mode:str; accepted:bool; message:str

class EmailAdapter:
    async def send(self,to:str,subject:str,body:str)->PlaceholderResult:
        return PlaceholderResult(settings.email_provider,"placeholder",False,"Email staged only; connect Gmail or Microsoft Graph OAuth.")
class StripeAdapter:
    async def create_checkout(self,client_id:str,amount_pence:int)->PlaceholderResult:
        return PlaceholderResult("Stripe","placeholder",False,"Checkout not created; configure Stripe sandbox credentials.")
