import boto3
from botocore.exceptions import ClientError
from app.core.config import settings

def send_verification_email(to_email: str, token: str):
    client = boto3.client('ses', region_name=settings.AWS_REGION)

    verify_url = f"https://streeeak.link/verify?token={token}"
    
    SENDER = "Streeeak <noreply@streeeak.link>"
    SUBJECT = "【Streeeak】メールアドレスの確認"
    BODY_TEXT = f"Streeeakへようこそ！以下のリンクをクリックして登録を完了してください。\n{verify_url}"
    BODY_HTML = f"""
    <html>
    <body>
        <h2>Streeeakへようこそ！</h2>
        <p>以下のリンクをクリックして登録を完了してください。</p>
        <a href="{verify_url}">メールアドレスを認証する</a>
    </body>
    </html>
    """

    try:
        response = client.send_email(
            Destination={'ToAddresses': [to_email]},
            Message={
                'Body': {
                    'Html': {'Charset': "UTF-8", 'Data': BODY_HTML},
                    'Text': {'Charset': "UTF-8", 'Data': BODY_TEXT},
                },
                'Subject': {'Charset': "UTF-8", 'Data': SUBJECT},
            },
            Source=SENDER,
        )
    except ClientError as e:
        print(f"Email send error: {e.response['Error']['Message']}")
        raise e