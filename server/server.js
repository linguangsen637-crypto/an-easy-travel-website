const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const https = require('https');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, param, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SALT_ROUNDS = 10;

// ==================== 安全中间件 ====================
app.use(helmet({
  contentSecurityPolicy: false, // 简化开发，生产环境应配置
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://yourdomain.com' 
    : ['http://localhost:3000'],
  credentials: true
}));

// 限流器
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制100个请求
  message: 'Too many requests from this IP, please try again later.'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 登录/注册限制更严格
  message: 'Too many authentication attempts, please try again later.'
});

app.use('/api/', limiter);
app.use(express.json());

// ==================== 数据库初始化 ====================
const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    location TEXT NOT NULL,
    price REAL NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // 创建索引提升查询性能
  db.run(`CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
});

// ==================== 工具函数 ====================
// JWT认证中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// 验证错误处理
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }
  next();
};

// ==================== 静态文件 ====================
app.use(express.static(path.join(__dirname, '..', 'public')));

// 请求日志
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ==================== 认证接口 ====================

// 注册
app.post('/api/register',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // 检查用户是否存在
      const existingUser = await new Promise((resolve, reject) => {
        db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      // 插入新用户
      const result = await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO users (email, password) VALUES (?, ?)',
          [email, hashedPassword],
          function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, email });
          }
        );
      });

      res.status(201).json({ 
        message: 'User registered successfully',
        userId: result.id 
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// 登录
app.post('/api/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // 查找用户
      const user = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // 验证密码
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // 生成JWT
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// ==================== 行程接口（需要认证）====================

// 获取用户的所有行程
app.get('/api/trips',
  authenticateToken,
  async (req, res) => {
    try {
      const trips = await new Promise((resolve, reject) => {
        db.all(
          'SELECT * FROM trips WHERE user_id = ? ORDER BY created_at DESC',
          [req.user.userId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      res.json(trips);
    } catch (error) {
      console.error('Fetch trips error:', error);
      res.status(500).json({ error: 'Failed to fetch trips' });
    }
  }
);

// 获取单个行程
app.get('/api/trip/:id',
  authenticateToken,
  [param('id').isInt()],
  handleValidationErrors,
  async (req, res) => {
    try {
      const trip = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM trips WHERE id = ? AND user_id = ?',
          [req.params.id, req.user.userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!trip) {
        return res.status(404).json({ error: 'Trip not found' });
      }

      res.json(trip);
    } catch (error) {
      console.error('Fetch trip error:', error);
      res.status(500).json({ error: 'Failed to fetch trip' });
    }
  }
);

// 创建行程
app.post('/api/trip',
  authenticateToken,
  [
    body('title').trim().notEmpty().isLength({ max: 200 }),
    body('location').trim().notEmpty().isLength({ max: 200 }),
    body('price').isFloat({ min: 0 }),
    body('description').optional().trim().isLength({ max: 2000 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { title, location, price, description } = req.body;

      const result = await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO trips (user_id, title, location, price, description) VALUES (?, ?, ?, ?, ?)',
          [req.user.userId, title, location, price, description || ''],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });

      const newTrip = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM trips WHERE id = ?', [result], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      res.status(201).json(newTrip);
    } catch (error) {
      console.error('Create trip error:', error);
      res.status(500).json({ error: 'Failed to create trip' });
    }
  }
);

// 更新行程
app.put('/api/trip/:id',
  authenticateToken,
  [
    param('id').isInt(),
    body('title').optional().trim().notEmpty().isLength({ max: 200 }),
    body('location').optional().trim().notEmpty().isLength({ max: 200 }),
    body('price').optional().isFloat({ min: 0 }),
    body('description').optional().trim().isLength({ max: 2000 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { title, location, price, description } = req.body;
      const tripId = req.params.id;

      // 验证所有权
      const existing = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id FROM trips WHERE id = ? AND user_id = ?',
          [tripId, req.user.userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!existing) {
        return res.status(404).json({ error: 'Trip not found' });
      }

      // 构建动态更新语句
      const updates = [];
      const values = [];

      if (title !== undefined) { updates.push('title = ?'); values.push(title); }
      if (location !== undefined) { updates.push('location = ?'); values.push(location); }
      if (price !== undefined) { updates.push('price = ?'); values.push(price); }
      if (description !== undefined) { updates.push('description = ?'); values.push(description); }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(tripId, req.user.userId);

      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE trips SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
          values,
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      const updatedTrip = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM trips WHERE id = ?', [tripId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      res.json(updatedTrip);
    } catch (error) {
      console.error('Update trip error:', error);
      res.status(500).json({ error: 'Failed to update trip' });
    }
  }
);

// 删除行程
app.delete('/api/trip/:id',
  authenticateToken,
  [param('id').isInt()],
  handleValidationErrors,
  async (req, res) => {
    try {
      const result = await new Promise((resolve, reject) => {
        db.run(
          'DELETE FROM trips WHERE id = ? AND user_id = ?',
          [req.params.id, req.user.userId],
          function(err) {
            if (err) reject(err);
            else resolve(this.changes);
          }
        );
      });

      if (result === 0) {
        return res.status(404).json({ error: 'Trip not found' });
      }

      res.json({ message: 'Trip deleted successfully' });
    } catch (error) {
      console.error('Delete trip error:', error);
      res.status(500).json({ error: 'Failed to delete trip' });
    }
  }
);

// ==================== 汇率接口（保持原有逻辑）====================
const rates = { USD: 1, EUR: 0.92, CNY: 7.3 };

app.get('/api/rates', (req, res) => {
  res.json(rates);
});

function fetchRemoteJson(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout }, (resp) => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

app.get('/api/latest', async (req, res) => {
  const base = req.query.base || 'USD';
  const providers = [
    `https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}`,
    `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`,
    `https://api.exchangerate-api.com/v4/latest/${encodeURIComponent(base)}`
  ];

  for (const url of providers) {
    try {
      const json = await fetchRemoteJson(url);
      if (json && json.rates) return res.json(json);
    } catch (err) {
      console.warn('Provider failed:', url, err.message);
    }
  }

  res.json({ base, rates });
});

app.get('/api/timeseries', async (req, res) => {
  const { start_date, end_date, base = 'USD', symbols = '' } = req.query;
  
  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'start_date and end_date required' });
  }

  const providers = [
    `https://api.exchangerate.host/timeseries?start_date=${encodeURIComponent(start_date)}&end_date=${encodeURIComponent(end_date)}&base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(symbols)}`,
    `https://api.frankfurter.app/${encodeURIComponent(start_date)}..${encodeURIComponent(end_date)}?from=${encodeURIComponent(base)}&to=${encodeURIComponent(symbols)}`
  ];

  for (const url of providers) {
    try {
      const json = await fetchRemoteJson(url);
      if (json && json.rates) return res.json(json);
    } catch (err) {
      console.warn('Timeseries provider failed:', url);
    }
  }

  // Fallback逻辑
  const ratesObj = {};
  const baseRate = rates[base] || 1;
  const targetRate = rates[symbols] || baseRate;
  const ratio = targetRate / baseRate;

  const start = new Date(start_date);
  const end = new Date(end_date);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    ratesObj[key] = { [symbols]: ratio };
  }

  res.json({ base, rates: ratesObj });
});

// ==================== 错误处理 ====================
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ==================== 优雅关闭 ====================
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  db.close(() => {
    console.log('Database closed');
    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});