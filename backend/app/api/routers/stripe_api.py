import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.core.config import settings

stripe.api_key = settings.STRIPE_API_KEY

router = APIRouter(prefix="/stripe", tags=["stripe"])

@router.post("/create-checkout-session")
def create_checkout_session(request: Request, current_user: User = Depends(get_current_user)):
    try:
        origin = request.headers.get("origin") or "https://streeeak.link"
        
        session = stripe.checkout.Session.create(
            ui_mode='embedded',
            line_items=[{
                'price': settings.STRIPE_PRICE_ID, 
                'quantity': 1,
            }],
            mode='subscription',
            return_url=f"{origin}/return?session_id={{CHECKOUT_SESSION_ID}}", 
            client_reference_id=str(current_user.id)
        )
        return {"clientSecret": session.client_secret}
    except Exception as e:
        print("======== STRIPE ERROR ========")
        print(e)
        print("==============================")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/session-status")
def session_status(session_id: str, db: Session = Depends(get_db)):
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        
        if session.status == 'complete' and session.client_reference_id:
            user_id = int(session.client_reference_id)
            user = db.query(User).filter(User.id == user_id).first()
            if user and not getattr(user, 'is_premium', False):
                user.is_premium = True 
                db.commit()

        return {
            "status": session.status, 
            "customer_email": session.customer_details.email if session.customer_details else None
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))