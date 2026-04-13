# Terraform backend state bucket
resource "aws_s3_bucket" "terraform_state" {
  bucket = "streeeak-terraform-state-storage"

  lifecycle {
    prevent_destroy = true
  }
}

# Enable versioning for the backend bucket
resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

# DynamoDB table for Terraform state locking
resource "aws_dynamodb_table" "terraform_lock" {
  name         = "streeeak-terraform-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  lifecycle {
    prevent_destroy = true
  }
}
