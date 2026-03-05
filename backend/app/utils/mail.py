import boto3
from app.core.config import settings

cognito_client = boto3.client('cognito-idp', region_name=settings.AWS_REGION)

def register_user(email: str, password: str):
    """
    ユーザーをCognitoに登録する。
    ※メール送信はCognitoが裏側で自動的にLambdaをキックして行ってくれます。
    """
    if settings.ENVIRONMENT == "local":
        print("\n" + "="*50)
        print("【ローカル】Cognitoへのダミー登録（スキップ等）")
        print("="*50 + "\n")
        return

    try:
        response = cognito_client.sign_up(
            ClientId=settings.COGNITO_CLIENT_ID, # 環境変数に追加してください
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