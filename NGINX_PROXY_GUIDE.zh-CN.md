# Nginx 反向代理指南

本指南说明如何为本项目及类似 Web 应用配置 Nginx 反向代理。

当前生产域名示例：`jsonnet.acexy.cn`。

## 1. 常见反向代理（HTTP）

当你的应用运行在 `127.0.0.1:3000` 时可使用如下配置。

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

## 2. 静态站点部署（适用于本仓库）

如果将本仓库按静态文件部署，可使用如下配置。

```nginx
server {
    listen 80;
    server_name example.com;

    root /var/www/jsonnet-review;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    location ~* ^/(app|bootstrap)\.js$|^/style\.css$ {
        add_header Cache-Control "no-cache";
    }

    location ~* \.wasm$ {
        default_type application/wasm;
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
    }

    location ~* ^/public/vendor/.*\.(js|css)$ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
    }

    location ~* ^/public/assets/.*\.(png|jpg|jpeg|gif|svg|ico|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
    }
}
```

## 3. 反向代理 + API 路径分流

前端静态文件由 Nginx 提供，`/api/` 请求转发到后端 `127.0.0.1:8080`。

```nginx
server {
    listen 80;
    server_name example.com;

    root /var/www/jsonnet-review;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    location ~* ^/(app|bootstrap)\.js$|^/style\.css$ {
        add_header Cache-Control "no-cache";
    }

    location ~* \.wasm$ {
        default_type application/wasm;
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
    }

    location ~* ^/public/vendor/.*\.(js|css)$ {
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

## 4. HTTPS（Let's Encrypt 场景）

在证书文件准备好后使用如下配置。

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

    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    location ~* ^/(app|bootstrap)\.js$|^/style\.css$ {
        add_header Cache-Control "no-cache";
    }

    location ~* \.wasm$ {
        default_type application/wasm;
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
    }

    location ~* ^/public/vendor/.*\.(js|css)$ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
    }
}
```

## 5. 校验与重载

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 6. 故障排查清单

- 检查 `server_name` 对应的 DNS 解析是否正确。
- 检查防火墙或安全组是否放行 `80` 与 `443` 端口。
- 确认本地应用端口（如 `3000`、`8080`）是否正在监听。
- 查看 Nginx 错误日志：

```bash
sudo tail -f /var/log/nginx/error.log
```

- 若 WebSocket 失败，确认已设置 `Upgrade` 与 `Connection` 头。
- 若上游返回 `502`，检查后端进程状态和 `proxy_pass` 目标地址。
- 若 Jsonnet 运行时加载失败，确认 `.wasm` 文件是否以 `application/wasm` 类型返回。
- 除非文件名带内容 hash，否则不要对 `index.html`、`app.js`、`bootstrap.js`、`style.css` 设置 immutable 缓存。

## 7. 生产环境加固建议

- 按需限制请求体大小：

```nginx
client_max_body_size 20m;
```

- 隐藏 Nginx 版本：

```nginx
server_tokens off;
```

- 增加基础安全响应头：

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```
