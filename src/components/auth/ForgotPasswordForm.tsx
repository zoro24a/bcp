"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";

const formSchema = z.object({
    email: z.string().email({ message: "Please enter a valid email address." }),
});

interface ForgotPasswordFormProps {
    onBackToLogin: () => void;
}

const ForgotPasswordForm = ({ onBackToLogin }: ForgotPasswordFormProps) => {
    const [loading, setLoading] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
            redirectTo: `${window.location.origin}/auth?type=recovery`,
        });

        if (error) {
            showError("Error: " + error.message);
        } else {
            showSuccess("Password reset link sent to your email!");
        }
        setLoading(false);
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                                <Input
                                    id="reset-email"
                                    type="email"
                                    placeholder="m@example.com"
                                    className="enhanced-input transition-all duration-300 hover:border-primary/50
                             focus:ring-4 focus:ring-primary/20 focus:border-primary
                             hover:shadow-md"
                                    {...field}
                                    disabled={loading}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button
                    type="submit"
                    className="w-full rounded-md font-semibold transition-all duration-300 ease-in-out
                     bg-primary text-primary-foreground relative overflow-hidden group
                     hover:bg-primary/90 hover:shadow-2xl hover:scale-[1.02] hover:-translate-y-1
                     active:scale-[0.98] active:translate-y-0
                     before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent
                     before:translate-x-[-100%] before:transition-transform before:duration-700
                     hover:before:translate-x-[100%]
                     focus:ring-4 focus:ring-primary/30 focus:outline-none"
                    disabled={loading}
                >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                        {loading ? "Sending..." : "Send Reset Link"}
                        {!loading && (
                            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">
                                →
                            </span>
                        )}
                    </span>
                </Button>

                <div className="text-center mt-4">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-sm text-muted-foreground hover:text-primary transition-all duration-300
                       hover:scale-105 flex items-center gap-2 mx-auto"
                        onClick={onBackToLogin}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Login
                    </Button>
                </div>
            </form>
        </Form>
    );
};

export default ForgotPasswordForm;
