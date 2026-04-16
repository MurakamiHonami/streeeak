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

output "ecr_backend_repository_url" {
  description = "ECR repository URL for backend image"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.backend.name
}

output "api_nlb_dns_name" {
  description = "Network Load Balancer DNS name for backend API"
  value       = aws_lb.api_nlb.dns_name
}

output "ecs_backend_log_group" {
  description = "CloudWatch Logs group for ECS backend"
  value       = aws_cloudwatch_log_group.ecs_backend.name
}
