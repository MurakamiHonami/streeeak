import boto3
from botocore.exceptions import ClientError
from app.core.config import settings

def send_verification_email(to_email: str, token: str):
    if settings.ENVIRONMENT == "local" or not settings.AWS_REGION:
        print("\n" + "="*50)
        print("【ローカルテスト】メール送信をスキップしました")
        print(f"宛先: {to_email}")
        print(f"認証トークン: {token}")
        print(f"認証用URL（例）: http://localhost:5173/verify?token={token}")
        print("="*50 + "\n")
        return
    try:
        client = boto3.client('ses', region_name="ap-northeast-1") # 東京リージョンの例
        
        verify_url = f"https://streeeak.link/verify?token={token}"
        
        SENDER = "Streeeak <noreply@streeeak.link>"
        
        try:
            client.send_email(
                Destination={'ToAddresses': [to_email]},
                Message={
                    'Body': {
                        'Html': {
                            'Charset': "UTF-8",
                            'Data': f"Streeeakへようこそ！<br><a href='{verify_url}'>こちらをクリックして認証を完了してください</a>",
                        }
                    },
                    'Subject': {'Charset': "UTF-8", 'Data': "【Streeeak】メール認証のお願い"},
                },
                Source=SENDER,
            )
        except ClientError as e:
            print(e.response['Error']['Message'])
    except Exception as e:
            print(e)