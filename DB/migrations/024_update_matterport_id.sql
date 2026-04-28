-- Migration to update Matterport ID to new space
-- New space: https://my.matterport.com/models/bccpUngJbTs

UPDATE events SET matterport_id = 'bccpUngJbTs' WHERE matterport_id = 'Ue6HUuFp67T';

-- Verify the update
SELECT id, title, matterport_id FROM events WHERE matterport_id = 'bccpUngJbTs';
