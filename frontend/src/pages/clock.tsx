import { useEffect, useState } from "react";
import AccessTimeIcon from '@mui/icons-material/AccessTime'; // MUI clock icon
import { Box, Typography } from "@mui/material";
import { useUpload } from "../context/useUpload"

type ProgressClockProps = {
    percentDone: number; // 0–100
};

export function ProgressClock({ percentDone }: ProgressClockProps) {
    const [elapsed, setElapsed] = useState(0); // seconds
    const { startTime } = useUpload(); // or however you consume it

    // Elapsed time updates every second
    useEffect(() => {
        if (!startTime) return;

        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [startTime]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}m ${s}s`;
    };

    let remaining: number | null = null;
    if (percentDone >= 100) {
        remaining = 0;
    } else if (percentDone > 0 && elapsed > 0) {
        const ratePerSecond = percentDone / elapsed;
        if (Number.isFinite(ratePerSecond) && ratePerSecond > 0) {
            remaining = Math.max(1, Math.ceil((100 - percentDone) / ratePerSecond));
        }
    }

    return (
        <Box>
            <Box display="flex" alignItems="center">
                <AccessTimeIcon fontSize="small" sx={{ mr: 0.5 }} />
                <Typography variant="body2">
                    Estimate remaining: {remaining !== null ? formatTime(remaining) : "Calculating..."}
                </Typography>
            </Box>
        </Box>
    );
}


/*<Box display="flex" alignItems="center" mb={1}>
                <AccessTimeIcon fontSize="small" sx={{ mr: 0.5 }} />
                <Typography variant="body2">Elapsed: {formatTime(elapsed)}</Typography>
            </Box>*/
