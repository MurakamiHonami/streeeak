# 1. CodeBuild プロジェクト
resource "aws_codebuild_project" "main" {
  name         = "streeeak-build"
  service_role = "arn:aws:iam::382715181910:role/service-role/codebuild-streeeak-build-service-role"

  artifacts {
    type = "CODEPIPELINE"
  }

  environment {
    compute_type    = "BUILD_GENERAL1_SMALL"
    image           = "aws/codebuild/amazonlinux2-x86_64-standard:4.0"
    type            = "LINUX_CONTAINER"
    privileged_mode = true
    environment_variable {
      name  = "S3_BUCKET_NAME"
      value = var.s3_bucket_name
    }
    environment_variable {
      name  = "CLOUDFRONT_ID"
      value = var.cloudfront_id
    }
    environment_variable {
      name  = "VITE_API_BASE_URL"
      value = var.vite_api_base_url
    }
    environment_variable {
      name  = "VITE_DEFAULT_USER_ID"
      value = var.vite_default_user_id
    }
    environment_variable {
      name  = "VITE_SUPABASE_URL"
      value = var.vite_supabase_url
    }
    environment_variable {
      name  = "VITE_SUPABASE_ANON_KEY"
      value = var.vite_supabase_anon_key
    }
    environment_variable {
      name  = "GEMINI_API_KEY"
      value = var.gemini_api_key
    }
    environment_variable {
      name  = "DATABASE_URL"
      value = var.database_url
    }
    environment_variable {
      name  = "ENV"
      value = var.env_name
    }
    environment_variable {
      name  = "APP_NAME"
      value = var.app_name
    }
    environment_variable {
      name  = "GEMINI_MODEL"
      value = var.gemini_model
    }
    environment_variable {
      name  = "AWS_REGION"
      value = var.aws_region_name
    }
    environment_variable {
      name  = "STRIPE_API_KEY"
      value = var.stripe_api_key
    }
    environment_variable {
      name  = "STRIPE_WEBHOOK_SECRET"
      value = var.stripe_webhook_secret
    }
    environment_variable {
      name  = "STRIPE_PRICE_ID"
      value = var.stripe_price_id
    }
    environment_variable {
      name  = "VITE_STRIPE_PUBLIC_KEY"
      value = var.vite_stripe_public_key
    }
  }


  source {
    type = "CODEPIPELINE"
  }
}

# 2. CodeDeploy アプリケーション
# resource "aws_codedeploy_app" "main" {
#   name             = "streeeak-app"
#   compute_platform = "Server"
# }

# デプロイグループ（ここもインポートが必要です）
# resource "aws_codedeploy_deployment_group" "main" {
#   app_name              = aws_codedeploy_app.main.name
#   deployment_group_name = "streeeak-dg"
#   service_role_arn      = "arn:aws:iam::382715181910:role/CodeDeploy-Service-Role"

#   deployment_style {
#     deployment_option = "WITH_TRAFFIC_CONTROL" # ALBを使わない場合はこれ、使う場合は調整
#     deployment_type   = "IN_PLACE"
#   }
#   load_balancer_info {
#     target_group_info {
#       name = "streeeak-tg"
#     }
#   }

#   ec2_tag_set {
#     ec2_tag_filter {
#       key   = "Name"
#       type  = "KEY_AND_VALUE"
#       value = "streeeak-api"
#     }
#   }
# }
# 3. CodePipeline
resource "aws_codepipeline" "main" {
  name     = "streeeak-pipeline"
  role_arn = "arn:aws:iam::382715181910:role/service-role/AWSCodePipelineServiceRole-ap-northeast-1-streeeak-pipeline"

  artifact_store {
    location = aws_s3_bucket.static_content.bucket
    type     = "S3"
  }

  stage {
    name = "Source"

    action {
      name             = "Source"
      category         = "Source"
      owner            = "AWS"
      provider         = "CodeStarSourceConnection"
      version          = "1"
      output_artifacts = ["source_output"]

      configuration = {
        ConnectionArn    = "arn:aws:codeconnections:ap-northeast-1:382715181910:connection/4e9ee864-cc52-4c92-acc5-fe287f6b5b58"
        FullRepositoryId = "MurakamiHonami/streeeak"
        BranchName       = "main"
      }
    }
  }

  stage {
    name = "Build"

    action {
      name             = "Build"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      input_artifacts  = ["source_output"]
      output_artifacts = ["build_output"]
      version          = "1"

      configuration = {
        ProjectName = aws_codebuild_project.main.name
      }
    }
  }

  stage {
    name = "Deploy"

    action {
      name            = "Deploy"
      category        = "Deploy"
      owner           = "AWS"
      provider        = "ECS"
      input_artifacts = ["build_output"]
      version         = "1"

      configuration = {
        ClusterName = aws_ecs_cluster.main.name
        ServiceName = aws_ecs_service.backend.name
        FileName    = "imagedefinitions.json"
      }
    }
  }
}
