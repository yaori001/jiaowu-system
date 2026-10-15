-- 教务管理系统数据库结构
-- MySQL 首次初始化时自动执行（挂载到 /docker-entrypoint-initdb.d）
-- 字符集统一 utf8mb4，支持中文与 emoji

SET NAMES utf8mb4;

-- ========== 用户 ==========
CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  username    VARCHAR(32)  NOT NULL UNIQUE,
  name        VARCHAR(32)  NOT NULL,
  password    VARCHAR(64)  NOT NULL,                -- 前端 cyrb53 加密后的哈希，服务端不存明文
  role        ENUM('admin','teacher','student') NOT NULL,
  class_id    INT          NULL,                    -- 仅学生有值
  dept        VARCHAR(64)  DEFAULT '',
  phone       VARCHAR(20)  DEFAULT '',
  status      TINYINT      NOT NULL DEFAULT 1,       -- 1 启用 0 禁用
  create_time DATETIME     NOT NULL,
  INDEX idx_role (role),
  INDEX idx_class (class_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 班级 ==========
CREATE TABLE IF NOT EXISTS classes (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(64) NOT NULL UNIQUE,
  major        VARCHAR(64) NOT NULL,
  year         INT         NOT NULL,
  counselor_id INT         NULL,                     -- 辅导员（教师 id）
  status       TINYINT     NOT NULL DEFAULT 1,
  create_time  DATETIME    NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 课程 ==========
CREATE TABLE IF NOT EXISTS courses (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(32)  NOT NULL UNIQUE,
  name        VARCHAR(64)  NOT NULL,
  type        ENUM('必修','选修') NOT NULL DEFAULT '必修',
  credit      DECIMAL(3,1) NOT NULL DEFAULT 2,
  hours       INT          NOT NULL DEFAULT 32,
  semester    VARCHAR(20)  NOT NULL,
  teacher_id  INT          NULL,
  create_time DATETIME     NOT NULL,
  INDEX idx_semester (semester),
  INDEX idx_teacher (teacher_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 课程-班级 多对多
CREATE TABLE IF NOT EXISTS course_class (
  course_id INT NOT NULL,
  class_id  INT NOT NULL,
  PRIMARY KEY (course_id, class_id),
  INDEX idx_class (class_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 课程排课（每门课可有多个上课时间）
CREATE TABLE IF NOT EXISTS course_schedule (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  weekday   TINYINT NOT NULL,                        -- 1-7
  section   TINYINT NOT NULL,                        -- 大节 1-5
  location  VARCHAR(64) NOT NULL,
  weeks     VARCHAR(20) NOT NULL DEFAULT '1-16',     -- 如 1-16
  INDEX idx_course (course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 成绩 ==========
CREATE TABLE IF NOT EXISTS scores (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  course_id  INT NOT NULL,
  student_id INT NOT NULL,
  usual      INT NULL,                               -- 平时成绩
  final      INT NULL,                               -- 期末成绩
  total      INT NULL,                               -- 综合成绩
  semester   VARCHAR(20) NOT NULL,
  UNIQUE KEY uk_course_student (course_id, student_id),
  INDEX idx_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 考勤 ==========
CREATE TABLE IF NOT EXISTS attendance (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  course_id   INT NOT NULL,
  class_id    INT NOT NULL,
  date        DATE NOT NULL,
  create_time DATETIME NOT NULL,
  update_time DATETIME NULL,
  UNIQUE KEY uk_course_class_date (course_id, class_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS attendance_record (
  attendance_id INT NOT NULL,
  student_id    INT NOT NULL,
  status        ENUM('present','late','leave','absent') NOT NULL DEFAULT 'present',
  PRIMARY KEY (attendance_id, student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 公告 ==========
CREATE TABLE IF NOT EXISTS notices (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  title        VARCHAR(128) NOT NULL,
  type         VARCHAR(32)  NOT NULL,
  content      TEXT         NOT NULL,
  status       ENUM('public','hidden') NOT NULL DEFAULT 'public',
  top          TINYINT      NOT NULL DEFAULT 0,
  publish_time DATETIME     NOT NULL,
  author_id    INT          NOT NULL,
  author_name  VARCHAR(32)  NOT NULL,
  create_time  DATETIME     NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notice_read (
  notice_id INT NOT NULL,
  user_id   INT NOT NULL,
  PRIMARY KEY (notice_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notice_reply (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  notice_id INT NOT NULL,
  user_id   INT NOT NULL,
  name      VARCHAR(32) NOT NULL,
  content   VARCHAR(255) NOT NULL,
  time      DATETIME NOT NULL,
  INDEX idx_notice (notice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 菜单与权限 ==========
CREATE TABLE IF NOT EXISTS menus (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  parent_id INT NOT NULL DEFAULT 0,
  title     VARCHAR(32) NOT NULL,
  path      VARCHAR(128) NOT NULL UNIQUE,
  component VARCHAR(128) DEFAULT '',
  icon      VARCHAR(32)  DEFAULT '',
  sort      INT NOT NULL DEFAULT 0,
  hidden    TINYINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 菜单可被哪些角色访问
CREATE TABLE IF NOT EXISTS menu_role (
  menu_id INT NOT NULL,
  role    ENUM('admin','teacher','student') NOT NULL,
  PRIMARY KEY (menu_id, role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 角色拥有的按钮权限
CREATE TABLE IF NOT EXISTS role_perm (
  role ENUM('admin','teacher','student') NOT NULL,
  perm VARCHAR(64) NOT NULL,
  PRIMARY KEY (role, perm)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
