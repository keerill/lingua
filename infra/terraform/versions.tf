terraform {
  required_version = ">= 1.6"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.43"
    }
  }

  # Optional shared state in DO Spaces (S3-compatible). Local state is fine for a
  # one-shot demo; uncomment + fill in for team/CI use.
  # backend "s3" {
  #   endpoints                   = { s3 = "https://fra1.digitaloceanspaces.com" }
  #   bucket                      = "lingua-tfstate"
  #   key                         = "staging/terraform.tfstate"
  #   region                      = "us-east-1" # ignored by DO, required by the AWS SDK
  #   skip_credentials_validation = true
  #   skip_metadata_api_check     = true
  #   skip_region_validation      = true
  #   skip_requesting_account_id  = true
  # }
}

provider "digitalocean" {
  token = var.do_token
}
