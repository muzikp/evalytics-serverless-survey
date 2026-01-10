/**
 * ========================================
 * MIGRATION 009 - Auto-save Interval Setting
 * ========================================
 * 
 * Přidání konfigurovatelného intervalu pro auto-save do campaigns table
 * 
 * Datum: 2026-01-10
 * Autor: muzikp
 * 
 * ZMĚNY:
 * - Přidán sloupec auto_save_interval_seconds do campaigns table
 * - Defaultní hodnota: 10 sekund
 * - NULL = auto-save vypnuto
 * - 0 nebo záporná hodnota = auto-save vypnuto
 */

USE evalytics_survey;

-- Přidání auto_save_interval_seconds do campaigns table
ALTER TABLE campaigns
ADD COLUMN auto_save_interval_seconds INT NULL DEFAULT 10
COMMENT 'Interval průběžného ukládání v sekundách (NULL = vypnuto, default 10)'
AFTER max_attempts;

-- Poznámka: Existující kampaně dostanou defaultní hodnotu 10 sekund
-- Pokud chcete auto-save vypnout pro konkrétní kampaň, nastavte hodnotu na NULL nebo 0
