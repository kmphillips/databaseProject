-- Canonical table definitions for this project (MySQL).
-- Run on an empty database, or add IF NOT EXISTS / migration steps to match your environment.
-- The app expects `Games.game_id` to be generated on INSERT (e.g. AUTO_INCREMENT on `game_id`).

CREATE TABLE IF NOT EXISTS Users (
    user_id     BIGINT PRIMARY KEY,
    username    VARCHAR(50)  NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP    NOT NULL,
    last_login  TIMESTAMP    NOT NULL,
    rating      INT          NOT NULL CHECK (rating >= 100)
);

CREATE TABLE IF NOT EXISTS Games (
  game_id       BIGINT PRIMARY KEY,
  created_by    BIGINT      NOT NULL,
  status        VARCHAR(20) NOT NULL,
  result        VARCHAR(20),
  time_control  VARCHAR(30),
  is_rated      BOOLEAN     NOT NULL,
  FOREIGN KEY (created_by) REFERENCES Users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HistoricalGame (
  game_id              BIGINT PRIMARY KEY,
  white_famous_player  VARCHAR(100) NOT NULL,
  black_famous_player  VARCHAR(100) NOT NULL,
  context              VARCHAR(255),
  FOREIGN KEY (game_id) REFERENCES Games(game_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS UploadedGame (
  game_id        BIGINT PRIMARY KEY,
  uploaded_by    BIGINT       NOT NULL,
  uploaded_at    TIMESTAMP    NOT NULL,
  opponent_name  VARCHAR(100) NOT NULL,
  context        VARCHAR(255),
  user_color     VARCHAR(5)   NOT NULL,
  FOREIGN KEY (game_id) REFERENCES Games(game_id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES Users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS SiteGame (
  game_id      BIGINT PRIMARY KEY,
  invite_code  VARCHAR(20) NOT NULL UNIQUE,
  game_time    INT         NOT NULL,
  FOREIGN KEY (game_id) REFERENCES Games(game_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Has (
  game_id       BIGINT     NOT NULL,
  user_id       BIGINT     NOT NULL,
  color         VARCHAR(5) NOT NULL,
  start_rating  INT        NOT NULL,
  end_rating    INT,
  PRIMARY KEY (game_id, user_id),
  FOREIGN KEY (game_id) REFERENCES SiteGame(game_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Moves (
  game_id      BIGINT      NOT NULL,
  move_number  INT         NOT NULL,
  notation     VARCHAR(30) NOT NULL,
  time         TIMESTAMP,
  PRIMARY KEY (game_id, move_number),
  FOREIGN KEY (game_id) REFERENCES Games(game_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS FriendsWith (
    user_id         BIGINT      NOT NULL,
    friend_user_id  BIGINT      NOT NULL,
    status          VARCHAR(20) NOT NULL,

    PRIMARY KEY (user_id, friend_user_id),

    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (friend_user_id) REFERENCES Users(user_id) ON DELETE CASCADE,

    CONSTRAINT chk_friend_status
        CHECK (status IN ('pending', 'accepted', 'rejected')),

    CONSTRAINT chk_not_self_friend
        CHECK (user_id <> friend_user_id)
);

CREATE TABLE IF NOT EXISTS UserAwards (
  user_id     BIGINT       NOT NULL,
  award_name  VARCHAR(100) NOT NULL,
  PRIMARY KEY (user_id, award_name),
  FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

CREATE TABLE IF NOT EXISTS UserFavoriteOpenings (
  user_id       BIGINT       NOT NULL,
  opening_name  VARCHAR(100) NOT NULL,
  PRIMARY KEY (user_id, opening_name),
  FOREIGN KEY (user_id) REFERENCES Users(user_id)
);
