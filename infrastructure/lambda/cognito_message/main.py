def lambda_handler(event, context):
    trigger = event.get("triggerSource", "")
    username = event.get("userName", "")
    code_placeholder = event.get("request", {}).get("codeParameter", "{####}")

    # Helpful for confirming invocation in CloudWatch logs.
    print(f"custom-message trigger={trigger} user={username}")

    if trigger in {"CustomMessage_SignUp", "CustomMessage_ResendCode"}:
        verify_url = f"https://streeeak.link/verify?username={username}&code={code_placeholder}"
        event["response"]["emailSubject"] = "Streeeak - Verify your email"
        event["response"]["emailMessage"] = (
            "<p>Welcome to Streeeak.</p>"
            "<p>Please verify your email from the link below:</p>"
            f"<p><a href='{verify_url}'>Verify email</a></p>"
            f"<p>If the link does not work, enter this code: <b>{code_placeholder}</b></p>"
        )

    return event
