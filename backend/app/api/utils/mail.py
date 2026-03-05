import boto3
from botocore.exceptions import ClientError
from app.core.config import settings

def lambda_handler(event, context):
    if event['triggerSource'] == "CustomMessage_SignUp":
        
        username = event['userName']
        code_placeholder = event['request']['codeParameter']
        
        verify_url = f"https://streeeak.link/verify?username={username}&code={code_placeholder}"
        
        event['response']['emailSubject'] = "【Streeeak】メール認証のお願い"
        event['response']['emailMessage'] = f"""
        Streeeakへようこそ！<br><br>
        以下のリンクをクリックして、アカウントの認証を完了してください。<br>
        <a href='{verify_url}'>こちらをクリックして認証を完了する</a>
        """

    return event

cognito_client = boto3.client('cognito-idp', region_name=settings.AWS_REGION)

def register_user(email: str, password: str):

    if settings.ENVIRONMENT == "local":
        print("\n" + "="*50)
        print("【ローカル】Cognitoへのダミー登録（スキップ等）")
        print("="*50 + "\n")
        return

    try:
        response = cognito_client.sign_up(
            ClientId=settings.COGNITO_CLIENT_ID,
            Username=email,
            Password=password,
            UserAttributes=[
                {'Name': 'email', 'Value': email}
            ]
        )
        return response
    except cognito_client.exceptions.UsernameExistsException:
        raise Exception("このメールアドレスは既に登録されています")
    except Exception as e:
        print(f"Cognito Signup Error: {e}")
        raise e


# def send_verification_email(to_email: str, token: str):
#     if settings.ENVIRONMENT == "local" or not settings.AWS_REGION:
#         print("\n" + "="*50)
#         print("【ローカルテスト】メール送信をスキップしました")
#         print(f"宛先: {to_email}")
#         print(f"認証トークン: {token}")
#         print(f"認証用URL（例）: http://localhost:5173/verify?token={token}")
#         print("="*50 + "\n")
#         return
#     try:
#         client = boto3.client('ses', region_name="ap-northeast-1") # 東京リージョンの例
        
#         verify_url = f"https://streeeak.link/verify?token={token}"
        
#         SENDER = "Streeeak <noreply@streeeak.link>"
        
#         try:
#             client.send_email(
#                 Destination={'ToAddresses': [to_email]},
#                 Message={
#                     'Body': {
#                         'Html': {
#                             'Charset': "UTF-8",
#                             'Data': f"Streeeakへようこそ！<br><a href='{verify_url}'>こちらをクリックして認証を完了してください</a>",
#                         }
#                     },
#                     'Subject': {'Charset': "UTF-8", 'Data': "【Streeeak】メール認証のお願い"},
#                 },
#                 Source=SENDER,
#             )
#         except ClientError as e:
#             print(e.response['Error']['Message'])
#     except Exception as e:
#             print(e)