resource "aws_ecs_cluster" "main" {
  name = "streeeak-prod-cluster"
}

resource "aws_lb" "api_nlb" {
  name               = "streeeak-api-nlb"
  internal           = false
  load_balancer_type = "network"
  subnets            = [aws_subnet.public_1a.id, aws_subnet.public_1c.id, aws_subnet.public_1d.id]

  enable_cross_zone_load_balancing = true
}

resource "aws_lb_target_group" "api_nlb_tg" {
  name        = "streeeak-api-nlb-tg"
  port        = 8000
  protocol    = "TCP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    protocol = "HTTP"
    path     = "/health"
    port     = "traffic-port"
  }
}

resource "aws_lb_listener" "api_nlb_tls" {
  load_balancer_arn = aws_lb.api_nlb.arn
  port              = 443
  protocol          = "TLS"
  certificate_arn   = var.api_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api_nlb_tg.arn
  }
}

resource "aws_iam_role" "ecs_task_execution_role" {
  name = "streeeak-ecs-task-execution-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_cloudwatch_log_group" "ecs_backend" {
  name              = "/ecs/streeeak-backend"
  retention_in_days = 14
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "streeeak-backend-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_execution_role.arn

  container_definitions = jsonencode([
    {
      name      = "streeeak-backend-container"
      image     = "${aws_ecr_repository.backend.repository_url}:latest"
      essential = true
      portMappings = [
        {
          containerPort = 8000
          hostPort      = 8000
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "APP_NAME", value = var.app_name },
        { name = "ENV", value = var.env_name },
        { name = "DATABASE_URL", value = var.database_url },
        { name = "SECRET_KEY", value = var.secret_key },
        { name = "ACCESS_TOKEN_EXPIRE_MINUTES", value = var.access_token_expire_minutes },
        { name = "GEMINI_API_KEY", value = var.gemini_api_key },
        { name = "GEMINI_MODEL", value = var.gemini_model },
        { name = "STRIPE_API_KEY", value = var.stripe_api_key },
        { name = "STRIPE_WEBHOOK_SECRET", value = var.stripe_webhook_secret },
        { name = "STRIPE_PRICE_ID", value = var.stripe_price_id },
        { name = "AWS_REGION", value = var.aws_region_name },
        { name = "COGNITO_CLIENT_ID", value = var.cognito_client_id },
        { name = "ENVIRONMENT", value = "prod" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.ecs_backend.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "backend" {
  name            = "streeeak-backend-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public_1a.id, aws_subnet.public_1c.id, aws_subnet.public_1d.id]
    security_groups  = [aws_security_group.web_sg.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api_nlb_tg.arn
    container_name   = "streeeak-backend-container"
    container_port   = 8000
  }

  depends_on = [aws_lb_listener.api_nlb_tls]
}

resource "aws_iam_role_policy_attachment" "ecs_cognito_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonCognitoPowerUser"
}
