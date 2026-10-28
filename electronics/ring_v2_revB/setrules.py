"""(Re)apply the Rev B flex design rules to a board (rules live in the .kicad_pro next to the board)."""
import sys, pcbnew
mm = pcbnew.FromMM


def apply(board):
    ds = board.GetDesignSettings()
    ds.m_TrackMinWidth = mm(0.075); ds.m_MinClearance = mm(0.075)
    ds.m_ViasMinSize = mm(0.2); ds.m_MinThroughDrill = mm(0.1); ds.m_ViasMinAnnularWidth = mm(0.05)
    ds.m_CopperEdgeClearance = mm(0.15); ds.m_HoleToHoleMin = mm(0.2); ds.m_HoleClearance = mm(0.1)
    ds.m_MinSilkTextHeight = mm(0.45); ds.m_SilkClearance = mm(0.0)
    ds.SetBoardThickness(mm(0.11))
    dc = ds.m_NetSettings.m_DefaultNetClass
    dc.SetClearance(mm(0.075)); dc.SetTrackWidth(mm(0.1)); dc.SetViaDiameter(mm(0.35)); dc.SetViaDrill(mm(0.15))


if __name__ == "__main__":
    b = pcbnew.LoadBoard(sys.argv[1]); apply(b); b.Save(sys.argv[1])
