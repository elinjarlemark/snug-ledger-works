import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface VoucherPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function VoucherPagination({ currentPage, totalPages, onPageChange }: VoucherPaginationProps) {
  const [jumpToPage, setJumpToPage] = useState("");

  if (totalPages <= 1) return null;

  const handleJumpToPage = () => {
    const page = parseInt(jumpToPage);
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
      setJumpToPage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleJumpToPage();
    }
  };

  // Generate page numbers to display
  const getPageNumbers = (): (number | "ellipsis")[] => {
    const pages: (number | "ellipsis")[] = [];
    
    // Always show first page
    pages.push(1);
    
    // Calculate range around current page
    const rangeStart = Math.max(2, currentPage - 2);
    const rangeEnd = Math.min(totalPages - 1, currentPage + 2);
    
    // Add ellipsis if there's a gap after first page
    if (rangeStart > 2) {
      pages.push("ellipsis");
    }
    
    // Add pages in range
    for (let i = rangeStart; i <= rangeEnd; i++) {
      pages.push(i);
    }
    
    // Add ellipsis if there's a gap before last page
    if (rangeEnd < totalPages - 1) {
      pages.push("ellipsis");
    }
    
    // Always show last page if more than 1 page
    if (totalPages > 1) {
      pages.push(totalPages);
    }
    
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 mt-4 py-3">
      {/* First page */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
        className="h-9 w-9"
        title="First page"
      >
        <ChevronsLeft className="h-4 w-4" />
      </Button>

      {/* Previous page */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="h-9 w-9"
        title="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Page numbers */}
      <div className="flex items-center gap-1">
        {pageNumbers.map((page, index) => 
          page === "ellipsis" ? (
            <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">...</span>
          ) : (
            <Button
              key={page}
              variant={currentPage === page ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(page)}
              className="h-9 w-9 p-0"
            >
              {page}
            </Button>
          )
        )}
      </div>

      {/* Next page */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="h-9 w-9"
        title="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {/* Last page */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
        className="h-9 w-9"
        title="Last page"
      >
        <ChevronsRight className="h-4 w-4" />
      </Button>

      {/* Jump to page input */}
      <div className="flex items-center gap-2 ml-4">
        <span className="text-sm text-muted-foreground whitespace-nowrap">Go to:</span>
        <Input
          type="number"
          min={1}
          max={totalPages}
          value={jumpToPage}
          onChange={(e) => setJumpToPage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="#"
          className="w-16 h-9 text-center"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleJumpToPage}
          disabled={!jumpToPage || parseInt(jumpToPage) < 1 || parseInt(jumpToPage) > totalPages}
          className="h-9"
        >
          Go
        </Button>
      </div>

      {/* Page info */}
      <span className="text-sm text-muted-foreground ml-2">
        Page {currentPage} of {totalPages}
      </span>
    </div>
  );
}
