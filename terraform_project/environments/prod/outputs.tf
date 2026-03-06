output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.main.id
}

output "subnet_1c_id" {
  description = "The ID of Subnet 1 (AZ-c)"
  value       = aws_subnet.public_1c.id
}

output "subnet_1d_id" {
  description = "The ID of Subnet 2 (AZ-d)"
  value       = aws_subnet.public_1d.id
}

output "web_sg_id" {
  description = "The ID of the Web Security Group"
  value       = aws_security_group.web_sg.id
}
output "cognito_client_id" {
  value       = aws_cognito_user_pool_client.client.id
  description = "FastAPIやReactに設定するCognitoのクライアントID"
}