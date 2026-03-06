terraform {
  required_version = ">= 1.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket         = "streeeak-terraform-state-storage"
    key            = "prod/terraform.tfstate"
    region         = "ap-northeast-1"
    dynamodb_table = "streeeak-terraform-lock"
    encrypt        = true
  }
}

provider "aws" {
  # profile = "terraform"
  region  = "ap-northeast-1"
}