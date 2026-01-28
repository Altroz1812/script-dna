-- Create enum for rule status
CREATE TYPE public.rule_status AS ENUM ('pending', 'approved', 'rejected');

-- Font Library table for storing character patterns
CREATE TABLE public.font_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character VARCHAR(10) NOT NULL,
    display_name VARCHAR(100),
    vector_paths JSONB NOT NULL DEFAULT '[]',
    normalized_bezier JSONB NOT NULL DEFAULT '[]',
    mean_slant_angle DECIMAL(10, 4),
    pressure_variance DECIMAL(10, 4),
    stroke_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stroke recordings table for raw physics data
CREATE TABLE public.stroke_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    font_library_id UUID REFERENCES public.font_library(id) ON DELETE CASCADE,
    stroke_data JSONB NOT NULL DEFAULT '[]',
    duration_ms INTEGER,
    avg_pressure DECIMAL(10, 4),
    avg_velocity DECIMAL(10, 4),
    slant_angle DECIMAL(10, 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Discovered rules table for AI-suggested patterns
CREATE TABLE public.discovered_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(200) NOT NULL,
    description TEXT,
    pattern_type VARCHAR(50) NOT NULL,
    detected_value DECIMAL(10, 4),
    tolerance_min DECIMAL(10, 4) DEFAULT 0,
    tolerance_max DECIMAL(10, 4) DEFAULT 0,
    impact_weight DECIMAL(5, 2) DEFAULT 1.0,
    status rule_status DEFAULT 'pending',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.font_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stroke_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovered_rules ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (admin-only system - will be restricted later with auth)
CREATE POLICY "Allow all operations on font_library" ON public.font_library FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on stroke_recordings" ON public.stroke_recordings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on discovered_rules" ON public.discovered_rules FOR ALL USING (true) WITH CHECK (true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_font_library_updated_at
    BEFORE UPDATE ON public.font_library
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_discovered_rules_updated_at
    BEFORE UPDATE ON public.discovered_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();