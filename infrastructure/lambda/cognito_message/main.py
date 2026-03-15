from urllib.parse import quote_plus


def lambda_handler(event, context):
    trigger = event.get("triggerSource", "")
    user_name = event.get("userName", "")
    email = event.get("request", {}).get("userAttributes", {}).get("email") or user_name
    code_placeholder = event.get("request", {}).get("codeParameter", "{####}")

    # Helpful for confirming invocation in CloudWatch logs.
    print(f"custom-message trigger={trigger} user={email}")

    if trigger in {"CustomMessage_SignUp", "CustomMessage_ResendCode"}:
        verify_url = (
            "https://streeeak.link/verify"
            f"?username={quote_plus(email)}"
            f"&code={code_placeholder}"
        )
        event["response"]["emailSubject"] = "【Streeeak】メール認証のご案内"
        event["response"]["emailMessage"] = (
            "<p>Streeeakへようこそ。</p>"
            "<p>以下のリンクをクリックして、メール認証を完了してください。</p>"
            f"<p><a href='{verify_url}'>こちらをクリックして認証する</a></p>"
            f"<p>リンクが開けない場合は、認証コードを入力してください: <b>{code_placeholder}</b></p>"
        )

    return event
