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