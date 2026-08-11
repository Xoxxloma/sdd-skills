import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('orders')
export class Order {
  @PrimaryColumn()
  id: string;

  @Column()
  contractNo: string;

  @Column({ type: 'varchar' })
  status: 'draft' | 'active' | 'closed';

  // closedAt пуст не только у черновиков: у активных аренд его тоже нет
  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date | null;
}
