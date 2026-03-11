"use client";

import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/components/auth/SessionContextProvider";
import CustomLoginForm from "@/components/auth/CustomLoginForm";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

const AuthPage = () => {
  const [isFlipped, setIsFlipped] = useState(false);
  const { session, loading, profile } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session && profile) {
      // If session and profile are loaded, SessionContextProvider should have already redirected.
      // This component will be unmounted.
    } else if (!loading && session && !profile) {
      // If session exists but profile is not yet loaded, wait for SessionContextProvider to handle it.
      // This might happen for new users before the profile trigger runs or if there's a delay.
      // For now, we'll just show a loading state.
    }
  }, [session, loading, profile, navigate]);

  if (loading || (session && !profile)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/40">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Loading...</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground">Please wait while we load your session.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (session && profile) {
    // If already logged in and profile is available, render nothing as a redirect is expected.
    return null;
  }

  return (
    <div
      className="relative min-h-screen w-full bg-cover bg-center flex items-center justify-center"
      style={{ backgroundImage: "url('/college-building.jpg')" }}
    >
      {/* Gradient Overlay for Readability */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/70 to-blue-600/70"></div>

      {/* Back button */}
      <div className="absolute top-4 left-4 z-20">
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="text-white hover:bg-white/20 transition-all duration-300
                     hover:scale-110 hover:shadow-lg hover:-translate-y-1
                     active:scale-105 active:translate-y-0
                     focus:ring-4 focus:ring-white/30 focus:outline-none
                     backdrop-blur-sm bg-black/10 border border-white/20"
        >
          <Link to="/" className="flex items-center justify-center">
            <ArrowLeft className="h-6 w-6 transition-transform duration-300 group-hover:-translate-x-1" />
            <span className="sr-only">Back to Home</span>
          </Link>
        </Button>
      </div>

      {/* Form Card */}
      <div className="relative z-10 w-full max-w-sm">
        {!isFlipped ? (
          <Card className="p-6 shadow-lg rounded-xl glass-card flex flex-col justify-center transition-all duration-300">
            <CardHeader className="text-center pt-0">
              <img src="/LOGO.jpg" alt="College Logo" className="mx-auto h-20 w-20 mb-4 rounded-full object-cover" />
              <CardTitle className="text-3xl font-bold text-foreground">Login</CardTitle>
              <CardDescription className="text-balance text-muted-foreground">
                Enter your email and password below to login to your account
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <CustomLoginForm onForgotPassword={() => setIsFlipped(true)} />
            </CardContent>
          </Card>
        ) : (
          <Card className="p-6 shadow-lg rounded-xl glass-card flex flex-col justify-center transition-all duration-300">
            <CardHeader className="text-center pt-0">
              <img src="/LOGO.jpg" alt="College Logo" className="mx-auto h-20 w-20 mb-4 rounded-full object-cover" />
              <CardTitle className="text-3xl font-bold text-foreground">Reset Password</CardTitle>
              <CardDescription className="text-balance text-muted-foreground">
                Enter your email address and we'll send you a link to reset your password.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <ForgotPasswordForm onBackToLogin={() => setIsFlipped(false)} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AuthPage;