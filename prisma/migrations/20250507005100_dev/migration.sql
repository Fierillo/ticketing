-- CreateIndex
CREATE INDEX "Ticket_serial_idx" ON "Ticket"("serial");

-- CreateIndex
CREATE INDEX "Ticket_serial_type_idx" ON "Ticket"("serial", "type");
