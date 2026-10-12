ALTER TABLE product ADD COLUMN image_path varchar(100);
ALTER TABLE product ADD CONSTRAINT product_image_path_check CHECK (
  image_path IS NULL OR image_path ~ '^/menu/[a-z0-9]+(-[a-z0-9]+)*\.webp$'
);
