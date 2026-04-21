-- Add is_custom_detected column to distinguish Plaid-detected vs custom-detected streams
ALTER TABLE public.recurring_streams 
ADD COLUMN IF NOT EXISTS is_custom_detected boolean DEFAULT false;

COMMENT ON COLUMN public.recurring_streams.is_custom_detected IS 'True if detected by our gap filler algorithm, false if from Plaid API';

-- Create index for filtering custom vs Plaid streams
CREATE INDEX IF NOT EXISTS idx_recurring_streams_custom_detected 
ON public.recurring_streams(is_custom_detected);
