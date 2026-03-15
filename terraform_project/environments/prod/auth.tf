data "archive_file" "cognito_message_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../../infrastructure/lambda/cognito_message"
  output_path = "${path.module}/cognito_message.zip"
}

resource "aws_iam_role" "lambda_exec" {
  name = "streeeak-cognito-message-lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "cognito_message" {
  filename         = data.archive_file.cognito_message_zip.output_path
  function_name    = "streeeak-cognito-custom-message"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "main.lambda_handler"
  runtime          = "python3.11"
  source_code_hash = data.archive_file.cognito_message_zip.output_base64sha256
}

resource "aws_cognito_user_pool" "main" {
  name = "streeeak-user-pool"

  username_attributes = ["email"]
  auto_verified_attributes = ["email"]

  lambda_config {
    custom_message = aws_lambda_function.cognito_message.arn
  }
}

resource "aws_lambda_permission" "allow_cognito" {
  statement_id  = "AllowExecutionFromCognito"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cognito_message.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

# 6. アプリケーション用クライアント（FastAPI/Reactから繋ぐ用）
resource "aws_cognito_user_pool_client" "client" {
  name         = "streeeak-app-client"
  user_pool_id = aws_cognito_user_pool.main.id
  generate_secret = false
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]
  prevent_user_existence_errors = "ENABLED"
}
