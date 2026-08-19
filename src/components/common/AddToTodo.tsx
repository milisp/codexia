import { ListPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useTodoStore } from '@/stores/useTodoStore';

type AddToTodoProps = {
  text: string;
  className?: string;
};

export const AddToTodo = ({ text, className }: AddToTodoProps) => {
  const addTodo = useTodoStore((state) => state.addTodo);

  const handleClick = () => {
    // A live selection inside this message wins over the whole message body.
    const selected = window.getSelection()?.toString().trim();
    if (!addTodo(selected || text)) return;
    toast.success('Added to todos');
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={!text.length}
      aria-label="Add to todo"
      className={className ?? 'h-6 w-6 text-muted-foreground'}
    >
      <ListPlus className="h-3 w-3" />
    </Button>
  );
};
