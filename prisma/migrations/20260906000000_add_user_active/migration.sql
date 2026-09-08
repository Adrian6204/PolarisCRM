-- Team & access management (G5): deactivatable user accounts.
ALTER TABLE "users" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
