import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Stores per-user email opt-in/opt-out preferences.
 * Non-critical emails (achievements, weekly summaries) respect these flags.
 * Transactional emails (welcome, password-reset) are always sent.
 */
@Entity('email_preferences')
export class EmailPreferences {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Foreign key to users.id — kept as a plain column to avoid circular deps. */
  @Column({ unique: true })
  userId!: string;

  /** Receive achievement-unlocked emails */
  @Column({ default: true })
  achievementEmails!: boolean;

  /** Receive weekly score summary emails */
  @Column({ default: true })
  weeklyEmails!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
