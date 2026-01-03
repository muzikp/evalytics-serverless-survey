USE evalytics_survey;

INSERT INTO users (user_id, firstname, lastname, email, password_hash, roles, created, last_update)
VALUES (
  'ADMIN001',
  'Pavel',
  'Muzik',
  'muzikp@gmail.com',
  '$2a$10$OMPVHo/PdQVxExjh/cHZ2uEAbdlT2O4Ts.p5sU/eUqRV6qx/6oNny',
  '{"master-admin": 1, "admin": 1}',
  NOW(),
  NOW()
);
