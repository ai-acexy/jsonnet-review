# Nginx Reverse Proxy Guide

This guide shows how to configure Nginx as a reverse proxy for this project and similar web apps.

Target production domain example: `jsonnet.acexy.cn`.

## 1. Common Reverse Proxy (HTTP)

Use this when your app is running on `127.0.0.1:3000`.

```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;

        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

## 2. Static Site Hosting (for this repo)

If you deploy this repository as static files:

```nginx
server {
    listen 80;
    server_name example.com;

    root /var/www/jsonnet-review;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.wasm$ {
        types {
            application/wasm wasm;
        }
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
    }
}
```

## 3. Reverse Proxy + API Path Split

Serve frontend static files and proxy API requests to backend `127.0.0.1:8080`.

```nginx
server {
    listen 80;
    server_name example.com;

    root /var/www/jsonnet-review;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.wasm$ {
        types {
            application/wasm wasm;
        }
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080/;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 4. HTTPS (Let's Encrypt style)

Use this after you have certificate files.

```nginx
server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    root /var/www/jsonnet-review;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.wasm$ {
        types {
            application/wasm wasm;
        }
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
    }
}
```

## 5. Validation and Reload

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 6. Troubleshooting Checklist

- Check DNS resolution for `server_name`.
- Check firewall/security group for ports `80` and `443`.
- Ensure local app ports (for example `3000` or `8080`) are actually listening.
- Verify Nginx error logs:

```bash
sudo tail -f /var/log/nginx/error.log
```

- If WebSocket fails, ensure `Upgrade` and `Connection` headers are set.
- If upstream returns `502`, verify backend process state and `proxy_pass` target.
- If Jsonnet runtime loading fails, verify that `.wasm` files are served with `application/wasm`.

## 7. Recommended Production Hardening

- Add request body size limit if needed:

```nginx
client_max_body_size 20m;
```

- Hide Nginx version:

```nginx
server_tokens off;
```

- Add basic security headers:

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```
