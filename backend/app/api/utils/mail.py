import boto3
from botocore.exceptions import ClientError
from app.core.config import settings

def send_verification_email(to_email: str, token: str):
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