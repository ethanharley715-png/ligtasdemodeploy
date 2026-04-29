-- AlterTable
ALTER TABLE "users" ADD COLUMN     "managed_by_user_id" INTEGER;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_managed_by_user_id_fkey" FOREIGN KEY ("managed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
