import React from 'react';
import { 
  Activity, ChartBar, Shield, FileText, MessageSquare, ExternalLink, 
  BarChart, Lock, FileSpreadsheet, Mail, Icon
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface AppLinkCardProps {
  name: string;
  icon: string;
  url: string;
  description?: string;
}

const AppLinkCard = ({ name, icon, url, description }: AppLinkCardProps) => {
  // Function to get the correct icon component based on the icon name
  const getIcon = (iconName: string): React.ReactNode => {
    const props = { className: 'h-6 w-6 text-primary', strokeWidth: 1.5 };
    
    switch (iconName.toLowerCase()) {
      case 'activity':
        return <Activity {...props} />;
      case 'chart-bar':
      case 'bar-chart':
        return <BarChart {...props} />;
      case 'shield':
      case 'lock':
        return <Shield {...props} />;
      case 'file-text':
      case 'file-spreadsheet':
        return <FileText {...props} />;
      case 'message-square':
      case 'mail':
        return <MessageSquare {...props} />;
      default:
        return <ExternalLink {...props} />;
    }
  };

  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <Card className="h-full hover:shadow-md transition-shadow duration-200">
        <CardContent className="p-4 flex flex-col items-center text-center">
          <div className="rounded-full bg-primary/10 p-3 mb-3">
            {getIcon(icon)}
          </div>
          <h3 className="font-medium text-sm">{name}</h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </CardContent>
      </Card>
    </a>
  );
};

export default AppLinkCard;