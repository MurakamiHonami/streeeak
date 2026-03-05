variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-northeast-1"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "streeeak"
}

variable "project" {
  description = "Project name"
  type        = string
  default     = "streeeak"
}

variable "environment" {
  description = "Environment (e.g., dev, prod)"
  type        = string
  default     = "prod"
}
variable "domain" {
  description = "Domain name"
  type        = string
  default     = "streeeak.link"
}
variable "s3_bucket_name" { type = string }
variable "cloudfront_id" { type = string }
variable "vite_api_base_url" { type = string }
variable "vite_default_user_id" { type = string }
variable "vite_supabase_url" { type = string }
variable "vite_supabase_anon_key" { type = string }
variable "gemini_api_key" { type = string }
variable "database_url" { type = string }
variable "env_name" { type = string }
variable "app_name" { type = string }
variable "gemini_model" { type = string }
variable "aws_region_name" { type = string }
variable "aws_access_key_id" { type = string }
variable "aws_secret_access_key" { type = string }
variable "stripe_api_key" { type = string }
variable "stripe_webhook_secret" { type = string }
variable "stripe_price_id" { type = string }
variable "vite_stripe_public_key" { type = string }