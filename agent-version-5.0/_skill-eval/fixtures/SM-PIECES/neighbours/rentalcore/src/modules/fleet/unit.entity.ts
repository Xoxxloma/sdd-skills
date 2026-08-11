import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('units')
export class Unit {
  @PrimaryColumn() id: string;
  @Column() plate: string;
  @Column({ type: 'varchar' }) state: 'idle' | 'rented' | 'decommissioned';
}
