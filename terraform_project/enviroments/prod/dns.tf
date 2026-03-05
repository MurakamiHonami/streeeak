# 1. Route53
resource "aws_route53_zone" "main" {
  name = "streeeak.link"
}

# 2. ACM 証明書
resource "aws_acm_certificate" "cert" {
  domain_name       = "api.streeeak.link"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# 3. CloudFront ディストリビューション
resource "aws_cloudfront_distribution" "main" {
  origin {
    domain_name              = "streeeak-frontend-111.s3.ap-northeast-1.amazonaws.com"
    origin_access_control_id = "E3K5GYQ0KBGC5A"
    origin_id                = "streeeak-frontend-111.s3.ap-northeast-1.amazonaws.com-mlyg120a0fn"
  }


  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  # 代替ドメイン名 (CNAME)
  aliases = ["streeeak.link"]

  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "streeeak-frontend-111.s3.ap-northeast-1.amazonaws.com-mlyg120a0fn"
    cache_policy_id        = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
  }
  ordered_cache_behavior {
    path_pattern           = "/avatars/*"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "streeeak-frontend-111.s3.ap-northeast-1.amazonaws.com-mlyg120a0fn"
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Planに出ていたID
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
  }
  ordered_cache_behavior {
    path_pattern           = "/*.png"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "streeeak-frontend-111.s3.ap-northeast-1.amazonaws.com-mlyg120a0fn"
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
  }
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  viewer_certificate {
    acm_certificate_arn      = "arn:aws:acm:us-east-1:382715181910:certificate/05cd50e3-7fd0-435b-a806-d3cdc7b7f320"
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = {
    Name = "streeeak-cloudfront"
  }
}

resource "aws_route53_record" "route53_record" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.streeeak.link"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}