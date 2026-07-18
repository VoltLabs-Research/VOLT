

export interface SignInInput{
    email: string;
    password: string;
}

export interface SignUpInput{
    email: string;
    firstName: string;
    lastName: string;
    password: string;
}

export interface UpdatePasswordInput{
    passwordCurrent?: string;
    password: string;
}

export interface UpdateAccountInput{
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email?: string;
    // avatar is uploaded as multipart/form-data, not part of the JSON body.
}
