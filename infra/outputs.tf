output "finance_project_id" {
  value = vercel_project.finance.id
}

output "admin_project_id" {
  value = vercel_project.admin.id
}

output "developer_project_id" {
  value = vercel_project.developer.id
}

output "vercel_nameservers" {
  description = "Nameservers to set on Namecheap for zervo.app"
  value       = ["ns1.vercel-dns.com", "ns2.vercel-dns.com"]
}
